export default function Welcome({ userGender, setUserGender, userInterest, setUserInterest, onStart }) {
  const ready = userGender && userInterest;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* Logo / decorative element */}
        <div className="mb-6">
          <span className="inline-block text-5xl">💘</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-3">
          What's Your<br />Dating Vibe?
        </h1>

        <p className="text-warm-gray text-base sm:text-lg mb-8 leading-relaxed">
          Answer 20 quick questions to discover your dating personality
          — and which iconic character matches your style
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-sand p-6 mb-6 text-left space-y-4">
          {/* Gender select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">I am...</label>
            <select
              value={userGender}
              onChange={e => setUserGender(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-cream px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral transition appearance-none"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </div>

          {/* Interest select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">I'm interested in...</label>
            <select
              value={userInterest}
              onChange={e => setUserInterest(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-cream px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral transition appearance-none"
            >
              <option value="">Select</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <p className="text-xs text-gray-400 leading-snug">
            We don't collect any personal information. These are only used to personalize your results.
          </p>
        </div>

        <button
          disabled={!ready}
          onClick={onStart}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all duration-200 ${
            ready
              ? 'bg-coral text-white shadow-lg shadow-coral/25 hover:bg-coral-dark active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Start Quiz
        </button>

        <p className="mt-6 text-xs text-gray-300">
          Takes about 2 minutes
        </p>
      </div>
    </div>
  );
}
