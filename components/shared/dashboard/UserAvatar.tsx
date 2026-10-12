"use client";

import React from "react";
import { HiUser } from "react-icons/hi";

interface UserAvatarProps {
  src?: string;
  alt?: string;
  className?: string;
}

export default function UserAvatar({
  src,
  alt,
  className = "",
}: UserAvatarProps) {
  const [hasError, setHasError] = React.useState(false);

  const baseClass =
    "relative flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 border border-gray-100 shadow-sm transition-all duration-300 group-hover:border-blue-200";

  if (!src || hasError) {
    return (
      <div className={`${baseClass} ${className}`}>
        <HiUser className="w-1/2 h-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </div>
    );
  }

  return (
    <div className={`${baseClass} ${className}`}>
      <img
        src={src}
        alt={alt || "User Avatar"}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
