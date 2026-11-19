/** The mnml wordmark in the text colour (so it follows light and dark mode), with the orange dot. Same drawing as public/brand/mnml-wordmark-currentcolor.svg. */
export function Logo() {
  return (
    <svg viewBox="0 0 265 86" height="22" role="img" aria-label="mnml-cms">
      <g transform="translate(5,5)" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 76V34a14 14 0 0 1 28 0v42M28 34a14 14 0 0 1 28 0v42" />
        <path d="M84 76V34a14 14 0 0 1 28 0v42" />
        <path d="M140 76V34a14 14 0 0 1 28 0v42M168 34a14 14 0 0 1 28 0v42" />
        <path d="M224 76V0" />
      </g>
      <circle cx="257" cy="81" r="5.5" fill="#FF5A1F" />
    </svg>
  );
}
