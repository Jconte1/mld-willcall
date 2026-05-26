// components/brand/BrandMark.tsx
import Image from "next/image";
import { appPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string; // wrapper styles
  size?: number;      // mark box size (px)
};

export default function BrandMark({ className, size = 60 }: BrandMarkProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center p-1", className)}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <Image
        src={appPath("/brand/MLD-logo-black.png")}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain select-none"
        priority
      />
    </span>
  );
}
