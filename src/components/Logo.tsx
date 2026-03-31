import Image from "next/image";

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/hevy-logo.png"
      alt="HevyAgent"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
