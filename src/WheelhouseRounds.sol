// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ISqueekCore {
    struct CoreState {
        uint64 settledThroughRound;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint64 blockHeight;
        uint96 blockProgress;
        uint32 workPerThousandBlocks;
        uint256 authorizationNonce;
        bool paused;
    }

    struct CoreConfiguration {
        bytes32 streamId;
        uint64 genesisTimestamp;
        uint64 roundDuration;
        uint64 maxWorkPerRound;
        uint16 maxRoundsPerBatch;
        address guardian;
        address reporter;
        uint32 initialWorkPerThousandBlocks;
        uint64 targetBlocksPerActiveRound;
        uint64 difficultySmoothingRounds;
        uint96 blockUnitsPerBlock;
    }

    struct LedgerPosition {
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
    }

    struct RoundCheckpoint {
        uint64 roundId;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
        bytes32 dataHash;
    }

    struct RoundPage {
        uint64 certifiedThroughRound;
        LedgerPosition start;
        LedgerPosition end;
        RoundCheckpoint[] rounds;
    }

    function state() external view returns (CoreState memory);
    function configuration() external view returns (CoreConfiguration memory);
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords)
        external
        view
        returns (RoundPage memory);
    function implementationCodeVersion() external view returns (uint64);
    function implementationCodeAddress() external view returns (address);
    function implementationStorageLayoutDigest() external view returns (bytes32);
}

/// @notice Free, public next-round predictions. No tokens, deposits, wagers or rewards of value.
/// @dev Scores are independent from the editable practice/local records in the static website.
contract WheelhouseRounds {
    error Unauthorized();
    error InvalidOwner();
    error CoreNotConfigured();
    error CoreAlreadyConfigured();
    error InvalidCore();
    error CoreIdentityChanged();
    error PredictionsPaused();
    error InvalidRound();
    error AlreadyPicked();
    error MissingPick();
    error AlreadySettled();
    error RoundNotCertified();
    error IncompleteRoundPage();

    struct Prediction {
        bool exists;
        bool willRun;
        bool settled;
        bool correct;
    }

    address public immutable owner;
    ISqueekCore public core;
    address public coreImplementation;
    bytes32 public coreLayoutDigest;
    bytes32 public streamId;
    uint64 public genesisTimestamp;
    uint64 public roundDuration;
    mapping(address player => mapping(uint64 round => Prediction)) public predictions;
    mapping(address player => uint256 points) public scores;
    mapping(address player => uint256 count) public settledPicks;

    event CoreConfigured(address indexed core, bytes32 indexed streamId, address implementation);
    event PredictionLocked(address indexed player, uint64 indexed round, bool willRun);
    event PredictionSettled(address indexed player, uint64 indexed round, bool ran, bool correct, uint256 points);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidOwner();
        owner = initialOwner;
    }

    /// @notice Owner configures the reviewed deployment once after launch. No address is guessed.
    function configureCore(address coreAddress) external {
        if (msg.sender != owner) revert Unauthorized();
        if (address(core) != address(0)) revert CoreAlreadyConfigured();
        if (coreAddress.code.length == 0) revert InvalidCore();
        ISqueekCore candidate = ISqueekCore(coreAddress);
        ISqueekCore.CoreConfiguration memory config = candidate.configuration();
        address implementation = candidate.implementationCodeAddress();
        bytes32 layout = candidate.implementationStorageLayoutDigest();
        if (
            candidate.implementationCodeVersion() != 3 || implementation == address(0) || layout == bytes32(0)
                || config.streamId == bytes32(0) || config.genesisTimestamp == 0 || config.roundDuration != 600
                || config.maxWorkPerRound != 10_000 || config.blockUnitsPerBlock != 1_000_000_000
        ) revert InvalidCore();
        core = candidate;
        coreImplementation = implementation;
        coreLayoutDigest = layout;
        streamId = config.streamId;
        genesisTimestamp = config.genesisTimestamp;
        roundDuration = config.roundDuration;
        emit CoreConfigured(coreAddress, config.streamId, implementation);
    }

    /// @notice Predict the next not-yet-started round. One immutable prediction per address and round.
    function predict(uint64 round, bool willRun) external {
        ISqueekCore source = _checkedCore();
        ISqueekCore.CoreState memory current = source.state();
        if (current.paused) revert PredictionsPaused();
        uint256 currentRound =
            block.timestamp < genesisTimestamp ? 0 : (block.timestamp - genesisTimestamp) / roundDuration + 1;
        if (round == 0 || uint256(round) != currentRound + 1 || round <= current.settledThroughRound) {
            revert InvalidRound();
        }
        Prediction storage prediction = predictions[msg.sender][round];
        if (prediction.exists) revert AlreadyPicked();
        prediction.exists = true;
        prediction.willRun = willRun;
        emit PredictionLocked(msg.sender, round, willRun);
    }

    /// @notice Anyone can settle another player's prediction; points always go to that player.
    /// @dev A one-round page covers omitted zero-work rounds as well as active rounds.
    function settle(address player, uint64 round) external {
        Prediction storage prediction = predictions[player][round];
        if (!prediction.exists) revert MissingPick();
        if (prediction.settled) revert AlreadySettled();
        ISqueekCore source = _checkedCore();
        if (source.state().settledThroughRound < round) revert RoundNotCertified();
        ISqueekCore.RoundPage memory page = source.roundPage(round - 1, round, 1);
        if (page.certifiedThroughRound != round || page.end.cumulativeWork < page.start.cumulativeWork) {
            revert IncompleteRoundPage();
        }
        bool ran = page.end.cumulativeWork > page.start.cumulativeWork;
        bool correct = ran == prediction.willRun;
        prediction.settled = true;
        prediction.correct = correct;
        settledPicks[player] += 1;
        uint256 points = correct ? 100 : 0;
        scores[player] += points;
        emit PredictionSettled(player, round, ran, correct, points);
    }

    function _checkedCore() private view returns (ISqueekCore source) {
        source = core;
        if (address(source) == address(0)) revert CoreNotConfigured();
        ISqueekCore.CoreConfiguration memory config = source.configuration();
        if (
            source.implementationCodeVersion() != 3 || source.implementationCodeAddress() != coreImplementation
                || source.implementationStorageLayoutDigest() != coreLayoutDigest || config.streamId != streamId
                || config.genesisTimestamp != genesisTimestamp || config.roundDuration != roundDuration
                || config.maxWorkPerRound != 10_000 || config.blockUnitsPerBlock != 1_000_000_000
        ) revert CoreIdentityChanged();
    }
}
