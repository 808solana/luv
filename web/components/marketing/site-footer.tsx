import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-white px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <Link href="/" aria-label="LUV13 home">
          <Image
            src="/BRAND_ASSETS/LUV13.png"
            alt="LUV13"
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        </Link>
        <p className="text-sm font-medium text-black/50">
          © {new Date().getFullYear()} LUV13
        </p>
      </div>
    </footer>
  );
}
