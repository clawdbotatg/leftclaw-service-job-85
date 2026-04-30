/**
 * HowItWorks — 4-step explainer rendered above the criteria list. Static.
 */
export const HowItWorks = () => {
  const steps: { n: number; text: string }[] = [
    { n: 1, text: "Connect your wallet" },
    { n: 2, text: "Pick a cause — each one analyzes holder addresses differently" },
    { n: 3, text: "Enter your CLAWD tip amount" },
    { n: 4, text: "Confirm the transaction and discover who gets it" },
  ];
  return (
    <div className="card bg-base-100 shadow-sm w-full">
      <div className="card-body p-5">
        <h2 className="card-title text-lg mb-2">How It Works</h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          {steps.map(({ n, text }) => (
            <li key={n} className="flex items-start gap-3">
              <span className="badge badge-primary badge-lg shrink-0 font-bold">{n}</span>
              <span className="text-sm">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
