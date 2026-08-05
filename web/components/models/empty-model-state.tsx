type EmptyModelStateProps = {
  onClear: () => void;
};

export function EmptyModelState({ onClear }: EmptyModelStateProps) {
  return (
    <div className="border border-dashed border-black/15 px-5 py-12 text-center sm:px-8">
      <h2 className="text-base font-bold text-black">No models match these filters.</h2>
      <p className="mt-2 text-sm text-black/60">
        Try another search or reset the active filters.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 min-h-11 rounded-lg border border-black/15 bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] focus-visible:ring-offset-2"
      >
        Clear filters
      </button>
    </div>
  );
}
