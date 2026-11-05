export function Hamster({
  mood = "ready",
  className = "",
}: {
  mood?: "ready" | "run" | "rest" | "win";
  className?: string;
}) {
  return (
    <svg
      className={`hamster-scene ${className} mood-${mood}`}
      viewBox="0 0 640 350"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="324" cy="312" rx="175" ry="13" fill="#d5ddbb" />
      <path
        d="m312 205-40 104m60-104 40 104"
        stroke="#555d47"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M254 310h137"
        stroke="#3f4835"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle
        cx="323"
        cy="157"
        r="133"
        fill="#eff1d9"
        stroke="#3f4835"
        strokeWidth="10"
      />
      <g
        className="wheel-spokes"
        style={{ transformOrigin: "323px 157px" }}
        stroke="#a4b183"
        strokeWidth="4"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M323 34v246"
            transform={`rotate(${i * 15} 323 157)`}
          />
        ))}
        <circle cx="323" cy="157" r="119" strokeWidth="2" />
      </g>
      <circle
        cx="323"
        cy="157"
        r="12"
        fill="#dce3bc"
        stroke="#3f4835"
        strokeWidth="5"
      />
      <g className="hamster-body">
        <path
          d="M258 241c-12 10-22 9-27 2-4-7 1-15 13-16"
          fill="#e6af7d"
          stroke="#523e2b"
          strokeWidth="3"
        />
        <ellipse
          cx="307"
          cy="231"
          rx="65"
          ry="44"
          fill="#c68a55"
          stroke="#523e2b"
          strokeWidth="3"
        />
        <path
          d="M258 228c10-31 41-45 70-31 20 10 30 32 18 51-19 30-75 24-88-3"
          fill="#e8bd88"
        />
        <path
          d="M273 253c15-23 51-29 67-8 6 10 0 23-18 24-20 3-38-2-49-16Z"
          fill="#fff2d5"
        />
        <path
          d="M299 194c-10-18-8-31 4-35 11-4 23 8 21 27"
          fill="#ce925e"
          stroke="#523e2b"
          strokeWidth="3"
        />
        <ellipse cx="308" cy="176" rx="7" ry="9" fill="#e8ad99" />
        <path
          d="M337 185c0-20 9-30 21-26 10 4 12 18-1 32"
          fill="#ce925e"
          stroke="#523e2b"
          strokeWidth="3"
        />
        <ellipse cx="350" cy="175" rx="7" ry="9" fill="#e8ad99" />
        <path
          d="M316 186c30-17 58-3 63 23l8 12c4 9-8 17-24 21-34 8-60-10-59-29"
          fill="#e6b27a"
          stroke="#523e2b"
          strokeWidth="3"
        />
        <path
          d="M346 218c11-5 25-2 30 5l7 3c-5 9-19 15-30 10-8-3-12-11-7-18Z"
          fill="#fff2d5"
        />
        {mood === "rest" ? (
          <path
            d="m346 205 5 3 6-3"
            stroke="#392e25"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : (
          <>
            <circle cx="352" cy="205" r="5" fill="#2f2922" />
            <circle cx="353.5" cy="203.5" r="1.5" fill="#fff" />
          </>
        )}
        <ellipse cx="382" cy="219" rx="5" ry="3.5" fill="#805747" />
        <path
          d="M367 227c-1 4 2 6 5 4m-5-6 25-1m-25 5 21 5"
          stroke="#805f43"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <ellipse cx="343" cy="218" rx="8" ry="5" fill="#e7997f" opacity=".65" />
        <path
          className="paw-back"
          d="m278 258-12 11c-4 7 11 8 18 1l13-10"
          fill="#e9ad8a"
          stroke="#523e2b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          className="paw-front"
          d="m330 255 12 13c7 7 21 5 16-2l-12-14"
          fill="#e9ad8a"
          stroke="#523e2b"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M212 234a133 133 0 0 0 222-3"
        stroke="#3f4835"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <g stroke="#778762" strokeWidth="2" strokeLinecap="round">
        <path d="m165 165-18 6m20-24-21-3m339 58 16 8m-18-24 18-2" />
      </g>
      <g fill="#8d9c6a">
        <path d="m470 78 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9Z" />
        <path d="m176 238 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
      </g>
    </svg>
  );
}
