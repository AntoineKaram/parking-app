// Medsquare square-and-check mark (brand colors #369BD8 / #2B60A7)
export default function Logo({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="6" width="15" height="15" rx="2" stroke="#369BD8" strokeWidth="3" />
      <path
        d="M6.5 13.5 L10.5 17 L23 3.5"
        stroke="#2B60A7"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
