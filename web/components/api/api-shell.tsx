import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type ApiShellProps = {
  children: React.ReactNode;
  title?: string;
};

export function ApiShell({ children, title = "API keys" }: ApiShellProps) {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col text-black">
      <Button
        asChild
        variant="link"
        className="group fixed left-0 top-0 z-20 h-auto items-center gap-1.5 p-4 text-white no-underline hover:text-white hover:no-underline sm:p-6 md:p-8"
      >
        <Link
          href="/"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] rounded-lg"
          aria-label="Back to home"
        >
              <ArrowLeft
                className="h-5 w-5 transition-transform duration-300 ease-out group-hover:-translate-x-1"
                strokeWidth={2}
                aria-hidden="true"
              />
        </Link>
      </Button>

      <main className="flex flex-1 flex-col px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-16 md:pt-24 lg:max-w-3xl">
        <div className="w-full max-w-xl rounded-[32px] bg-white px-6 py-8 shadow-lg sm:px-8 sm:py-10 md:mx-0 md:max-w-none flex flex-col gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
            {title}
          </h1>
          {children}
        </div>
      </main>
    </div>
  );
}
