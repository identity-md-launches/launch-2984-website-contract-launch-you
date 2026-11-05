// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ISqueekCore, WheelhouseRounds} from "../src/WheelhouseRounds.sol";
import {Deploy} from "../script/Deploy.s.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function chainId(uint256) external;
}

contract CoreFixture is ISqueekCore {
    CoreConfiguration private config;
    uint64 public frontier;
    bool public isPaused;
    bool public incomplete;
    address public implementation = address(this);
    mapping(uint64 => uint64) public work;

    constructor() {
        config.streamId = keccak256("test-stream");
        config.genesisTimestamp = 1_000;
        config.roundDuration = 600;
        config.maxWorkPerRound = 10_000;
        config.blockUnitsPerBlock = 1_000_000_000;
    }

    function certify(uint64 round, uint64 amount) external {
        frontier = round;
        work[round] = amount;
    }

    function pause(bool value) external {
        isPaused = value;
    }

    function upgrade(address value) external {
        implementation = value;
    }

    function setIncomplete(bool value) external {
        incomplete = value;
    }

    function changeStream() external {
        config.streamId = keccak256("other-stream");
    }

    function state() external view returns (CoreState memory s) {
        s.settledThroughRound = frontier;
        s.paused = isPaused;
    }

    function configuration() external view returns (CoreConfiguration memory) {
        return config;
    }

    function implementationCodeVersion() external pure returns (uint64) {
        return 3;
    }

    function implementationCodeAddress() external view returns (address) {
        return implementation;
    }

    function implementationStorageLayoutDigest() external pure returns (bytes32) {
        return keccak256("fixture-layout");
    }

    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords)
        external
        view
        returns (RoundPage memory p)
    {
        require(throughRound <= frontier && throughRound == afterRound + 1 && maxRecords == 1, "bounds");
        p.certifiedThroughRound = incomplete ? afterRound : throughRound;
        p.start.cumulativeWork = 73;
        p.end.cumulativeWork = 73 + work[throughRound];
        p.rounds = new RoundCheckpoint[](work[throughRound] > 0 ? 1 : 0);
    }
}

contract WheelhouseRoundsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    WheelhouseRounds private game;
    CoreFixture private source;
    address private constant PLAYER = address(0x1001);
    address private constant OTHER = address(0x1002);

    function setUp() public {
        source = new CoreFixture();
        game = new WheelhouseRounds(address(this));
        game.configureCore(address(source));
        vm.warp(1_000);
    }

    function testNotConfigured() public {
        WheelhouseRounds empty = new WheelhouseRounds(address(this));
        vm.expectRevert(WheelhouseRounds.CoreNotConfigured.selector);
        empty.predict(2, true);
    }

    function testRejectZeroOwner() public {
        vm.expectRevert(WheelhouseRounds.InvalidOwner.selector);
        new WheelhouseRounds(address(0));
    }

    function testConfigurationOwnerAndOneTime() public {
        WheelhouseRounds fresh = new WheelhouseRounds(address(this));
        vm.prank(PLAYER);
        vm.expectRevert(WheelhouseRounds.Unauthorized.selector);
        fresh.configureCore(address(source));
        vm.expectRevert(WheelhouseRounds.InvalidCore.selector);
        fresh.configureCore(PLAYER);
        fresh.configureCore(address(source));
        vm.expectRevert(WheelhouseRounds.CoreAlreadyConfigured.selector);
        fresh.configureCore(address(source));
        require(fresh.owner() == address(this), "requester owner retained");
    }

    function testRunCorrectAndPermissionlessSettlement() public {
        vm.prank(PLAYER);
        game.predict(2, true);
        source.certify(2, 19);
        vm.prank(OTHER);
        game.settle(PLAYER, 2);
        require(game.scores(PLAYER) == 100 && game.scores(OTHER) == 0, "only player earns");
        (bool exists, bool willRun, bool settled, bool correct) = game.predictions(PLAYER, 2);
        require(exists && willRun && settled && correct, "settled run");
    }

    function testCertifiedZeroRoundIsRest() public {
        vm.prank(PLAYER);
        game.predict(2, false);
        source.certify(2, 0);
        game.settle(PLAYER, 2);
        require(game.scores(PLAYER) == 100, "zero certified rest");
    }

    function testUnsettledNeverZero() public {
        vm.prank(PLAYER);
        game.predict(2, false);
        vm.expectRevert(WheelhouseRounds.RoundNotCertified.selector);
        game.settle(PLAYER, 2);
        require(game.settledPicks(PLAYER) == 0, "unknown remains pending");
    }

    function testWrongPredictionNoPoints() public {
        vm.prank(PLAYER);
        game.predict(2, false);
        source.certify(2, 1);
        game.settle(PLAYER, 2);
        require(game.scores(PLAYER) == 0 && game.settledPicks(PLAYER) == 1, "wrong is recorded");
    }

    function testDuplicatePickAndSettlementRejected() public {
        vm.prank(PLAYER);
        game.predict(2, true);
        vm.prank(PLAYER);
        vm.expectRevert(WheelhouseRounds.AlreadyPicked.selector);
        game.predict(2, false);
        source.certify(2, 1);
        game.settle(PLAYER, 2);
        vm.expectRevert(WheelhouseRounds.AlreadySettled.selector);
        game.settle(PLAYER, 2);
    }

    function testOnlyNextRoundBeforeItsStart() public {
        vm.expectRevert(WheelhouseRounds.InvalidRound.selector);
        game.predict(0, true);
        vm.expectRevert(WheelhouseRounds.InvalidRound.selector);
        game.predict(1, true);
        vm.expectRevert(WheelhouseRounds.InvalidRound.selector);
        game.predict(3, true);
        vm.warp(1_600);
        vm.expectRevert(WheelhouseRounds.InvalidRound.selector);
        game.predict(2, true);
        game.predict(3, true);
    }

    function testCanPredictFirstRoundBeforeGenesis() public {
        vm.warp(999);
        game.predict(1, true);
    }

    function testPausedBlocksPicksButNotCertifiedResults() public {
        game.predict(2, false);
        source.pause(true);
        vm.prank(PLAYER);
        vm.expectRevert(WheelhouseRounds.PredictionsPaused.selector);
        game.predict(2, true);
        source.certify(2, 0);
        game.settle(address(this), 2);
        require(game.scores(address(this)) == 100, "read certified history when paused");
    }

    function testUpgradeStopsPicksAndSettlement() public {
        game.predict(2, true);
        source.certify(2, 1);
        source.upgrade(OTHER);
        vm.expectRevert(WheelhouseRounds.CoreIdentityChanged.selector);
        game.settle(address(this), 2);
        vm.expectRevert(WheelhouseRounds.CoreIdentityChanged.selector);
        game.predict(3, true);
    }

    function testChangedStreamRejected() public {
        source.changeStream();
        vm.expectRevert(WheelhouseRounds.CoreIdentityChanged.selector);
        game.predict(2, true);
    }

    function testIncompletePageRemainsPending() public {
        game.predict(2, false);
        source.certify(2, 0);
        source.setIncomplete(true);
        vm.expectRevert(WheelhouseRounds.IncompleteRoundPage.selector);
        game.settle(address(this), 2);
        require(game.settledPicks(address(this)) == 0, "no partial page settlement");
    }

    function testMissingPrediction() public {
        vm.expectRevert(WheelhouseRounds.MissingPick.selector);
        game.settle(PLAYER, 2);
    }

    function testDeploymentChainAndOwner() public {
        Deploy deployer = new Deploy();
        vm.chainId(1);
        vm.expectRevert(Deploy.WrongChain.selector);
        deployer.deploy(PLAYER);
        vm.chainId(11_155_111);
        WheelhouseRounds deployed = deployer.run(PLAYER);
        require(
            deployed.owner() == PLAYER && address(deployed.core()) == address(0), "unconfigured requester-owned launch"
        );
    }

    function testFuzzPointsMatchCertifiedWork(uint64 rawWork, bool willRun) public {
        uint64 amount = rawWork % 10_001;
        vm.prank(PLAYER);
        game.predict(2, willRun);
        source.certify(2, amount);
        game.settle(PLAYER, 2);
        require(game.scores(PLAYER) == ((amount > 0) == willRun ? 100 : 0), "score matches only settled work");
        require(game.settledPicks(PLAYER) == 1, "exactly one settlement");
    }

    function testFuzzRoundTiming(uint32 rawTime) public {
        uint256 nowTime = 1_000 + uint256(rawTime);
        vm.warp(nowTime);
        uint64 next = uint64((nowTime - 1_000) / 600 + 2);
        game.predict(next, true);
        vm.prank(PLAYER);
        vm.expectRevert(WheelhouseRounds.InvalidRound.selector);
        game.predict(next - 1, true);
    }
}
