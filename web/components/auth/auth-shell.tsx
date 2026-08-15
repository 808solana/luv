import Image from "next/image";
import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center bg-white px-4 py-10 text-black sm:px-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mx-auto mb-10 flex min-h-11 w-fit items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="LUV13 home"
        >
          <Image
            src="/BRAND_ASSETS/LUV13.png"
            alt="LUV13"
            width={120}
            height={40}
            priority
          />
        </Link>
        <section className="rounded-[32px] bg-white p-6 shadow-[0_20px_70px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] sm:p-9">
          <header className="mb-8">
            <h1 className="text-balance text-3xl font-bold tracking-tight">
              {title}
            </h1>
            <p className="mt-3 text-pretty text-base leading-7 text-black/60">
              {description}
            </p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
