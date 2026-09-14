import { CLIENT_PROVIDERS, type ClientProvider } from "@/lib/client-providers";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ShieldedImage } from "@/components/ui/shielded-image";

function ProviderRow({ provider }: { provider: ClientProvider }) {
  return (
    <article className="flex items-center gap-3 py-3.5">
      <ShieldedImage
        src={provider.src}
        alt={provider.alt}
        className="size-[4.6875rem] shrink-0"
      />
      <div className="min-w-0 w-max max-w-full pt-0.5">
        <h3 className="text-[15px] font-semibold tracking-tight text-black">
          {provider.name}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] leading-5">
          <p className="font-medium text-black">{provider.kind}</p>
          <p className="font-medium text-black">{provider.access}</p>
          <MagneticButton>
            <a
              href={provider.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${provider.name} on OpenRouter`}
              className="inline-flex min-h-7 items-center rounded-full border border-black bg-white px-3 text-[12px] font-medium tracking-tight text-black motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.96] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12]"
            >
              Open
            </a>
          </MagneticButton>
        </div>
      </div>
    </article>
  );
}

/** Compact stacked list of pair-with clients — same even row shape as hosted models. */
export function ProviderPane() {
  return (
    <div className="flex w-full justify-center">
      <div
        className="w-max max-w-full divide-y divide-black/10"
        role="list"
        aria-label="Pair with Cursor, Hermes, VS Code, FreeBuff, Open WebUI, Kilo Code, and Codex"
      >
        {CLIENT_PROVIDERS.map((provider: ClientProvider) => (
          <div
            key={provider.id}
            role="listitem"
            data-magnetic-bounds
            className="overflow-hidden"
          >
            <ProviderRow provider={provider} />
          </div>
        ))}
      </div>
    </div>
  );
}
