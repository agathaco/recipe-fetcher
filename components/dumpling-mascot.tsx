// Miam's mascot: a kawaii steamed bao bun, dumpling-shaped (round body, a
// twisted top-knot with pleat creases, a char siu marker dot), not the
// crescent-pleated gyoza shape this started as, per the user's reference.
// Three moods: "happy" (the no-photo placeholder on recipe cards, plus
// login/signup), "sleepy" (empty states, "nothing here yet"), and
// "confused" (404 / unexpected-error pages, see error.tsx and
// not-found.tsx). Colors are literal, not theme tokens on purpose: this is
// a brand illustration with its own warm cream/blush palette, not UI chrome
// that needs to track light/dark mode, which the app doesn't support yet
// anyway (see IDEAS.md). Prototyped and screenshotted via a throwaway
// Playwright script before landing here, not just eyeballed as raw markup.
type Mood = "happy" | "sleepy" | "confused";

// Per-mood tweaks to the shared body parts (arms droop and blush fades a
// touch once the bun isn't bright-eyed happy).
const BODY_BY_MOOD: Record<Mood, { armRotate: number; armCy: number; blushOpacity: number }> = {
  happy: { armRotate: 15, armCy: 62, blushOpacity: 0.7 },
  sleepy: { armRotate: 8, armCy: 63, blushOpacity: 0.6 },
  confused: { armRotate: 15, armCy: 62, blushOpacity: 0.6 },
};

export function DumplingMascot({
  className,
  mood = "happy",
  plate = false,
}: {
  className?: string;
  mood?: Mood;
  plate?: boolean;
}) {
  const { armRotate, armCy, blushOpacity } = BODY_BY_MOOD[mood];

  return (
    <svg viewBox="0 -15 100 115" className={className} aria-hidden="true">
      {/* steam, happy mood only: it's fresh off the steamer, the other two
          moods have gone cold and quiet */}
      {mood === "happy" && (
        <g fill="none" stroke="#c9bfe0" strokeWidth="2" strokeLinecap="round" opacity="0.8">
          <path d="M38,10 Q34,4 38,-2 Q42,-8 38,-13" />
          <path d="M50,8 Q46,2 50,-4 Q54,-10 50,-15" opacity="0.6" />
          <path d="M62,10 Q58,4 62,-2 Q66,-8 62,-13" />
        </g>
      )}

      {plate && <ellipse cx="50" cy="83" rx="30" ry="5" fill="#e0d5ef" />}

      {/* stubby arms, behind the body */}
      <ellipse
        cx="15"
        cy={armCy}
        rx="7"
        ry="5"
        fill="#fdf1de"
        stroke="#6b5a48"
        strokeWidth="2"
        transform={`rotate(-${armRotate} 15 ${armCy})`}
      />
      <ellipse
        cx="85"
        cy={armCy}
        rx="7"
        ry="5"
        fill="#fdf1de"
        stroke="#6b5a48"
        strokeWidth="2"
        transform={`rotate(${armRotate} 85 ${armCy})`}
      />

      {/* round bun body */}
      <ellipse cx="50" cy="58" rx="34" ry="28" fill="#fdf1de" stroke="#6b5a48" strokeWidth="2" />

      {/* twisted top-knot, where the dough is gathered and pinched */}
      <path
        d="M40,33 Q42,21 50,19 Q58,21 60,33 Q55,28 50,29 Q45,28 40,33 Z"
        fill="#fdf1de"
        stroke="#6b5a48"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* pleat creases fanning down from the knot */}
      <g fill="none" stroke="#6b5a48" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
        <path d="M43,32 Q35,37 29,45" />
        <path d="M50,30 Q49,38 47,46" />
        <path d="M57,32 Q65,37 71,45" />
      </g>

      {/* char siu marker, the classic bao red dot */}
      <circle cx="50" cy="23" r="2.2" fill="#e8607a" />

      <ellipse cx="32" cy={armCy} rx="5" ry="3" fill="#f7a8b8" opacity={blushOpacity} />
      <ellipse cx="68" cy={armCy} rx="5" ry="3" fill="#f7a8b8" opacity={blushOpacity} />

      {mood === "happy" && (
        <>
          <path
            d="M30,55 Q35,50 40,55"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M60,55 Q65,50 70,55"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M44,66 Q50,70 56,66"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}

      {mood === "sleepy" && (
        <>
          <path
            d="M29,57 L41,57"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M59,57 L71,57"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <ellipse cx="50" cy="68" rx="3" ry="2.4" fill="#3a2f28" />
          <g fill="#6b5a48" fontFamily="Georgia, serif">
            <text x="72" y="10" fontSize="11" opacity="0.7">
              z
            </text>
            <text x="78" y="3" fontSize="8" opacity="0.6">
              z
            </text>
            <text x="83" y="-2" fontSize="6" opacity="0.5">
              z
            </text>
          </g>
        </>
      )}

      {mood === "confused" && (
        <>
          {/* eyebrows raised unevenly, puzzled rather than upset */}
          <path
            d="M27,50 Q32,46 38,49"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M62,52 Q66,50 71,52"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="33" cy="56" r="2.2" fill="#3a2f28" />
          <circle cx="67" cy="57" r="2.2" fill="#3a2f28" />
          {/* wavy, uncertain mouth */}
          <path
            d="M43,67 Q46,64 49,67 Q52,70 55,67"
            fill="none"
            stroke="#3a2f28"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <text x="72" y="8" fontFamily="Georgia, serif" fontSize="20" fill="#6b5a48" opacity="0.75">
            ?
          </text>
        </>
      )}
    </svg>
  );
}
