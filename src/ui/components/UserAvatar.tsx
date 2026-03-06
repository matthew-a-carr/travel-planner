'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

type UserAvatarProps = {
  image: string | null | undefined;
  name: string | null | undefined;
};

function toInitials(name: string | null | undefined) {
  if (!name) return 'U';
  const tokens = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (tokens.length === 0) return 'U';
  return tokens.map((token) => token.charAt(0).toUpperCase()).join('');
}

export function UserAvatar({ image, name }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => toInitials(name), [name]);
  const imageSrc = typeof image === 'string' && image.length > 0 ? image : null;

  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
      {imageSrc && !imageFailed ? (
        <Image
          src={imageSrc}
          alt={name ?? 'User'}
          className="h-8 w-8 object-cover"
          width={32}
          height={32}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className="flex h-8 w-8 items-center justify-center text-xs font-semibold"
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </div>
  );
}
