import { useId } from 'react';

interface Props {
  className?: string;
  thinking?: boolean;
}

export function AtlasLogo({ className = 'w-6 h-6', thinking = false }: Props) {
  const gradientId = `atlas-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} ${thinking ? 'atlas-thinking' : ''}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F8CFF" />
          <stop offset="0.55" stopColor="#9B72F2" />
          <stop offset="1" stopColor="#E8836B" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
