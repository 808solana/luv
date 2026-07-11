import Image from "next/image";
import Link from "next/link";

type ApiShellProps = {
  children: React.ReactNode;
  title?: string;
};

export function ApiShell({ children, title = "API keys" }: ApiShellProps) {
  return (
    <div className="relative z-10 flex flex-1 flex-col px-4 py-10 text-black sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56]"
          >
            <Image
              src="/BRAND_ASSETS/LUV13.png"
              alt="LUV13 home"
              width={96}
              height={32}
              priority
            />
          </Link>
        </header>

        <div className="rounded-[32px] bg-white px-6 py-8 shadow-lg sm:px-8 sm:py-10 flex flex-col gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}
