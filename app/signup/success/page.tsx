// =====================================================
// SIGNUP SUCCESS PAGE (SAFE VERSION)
// =====================================================

export const dynamic = "force-dynamic";

export default function SignupSuccessPage({
  searchParams,
}: {
  searchParams?: { email?: string };
}) {

  const email = searchParams?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full bg-neutral-900 p-8 rounded-xl shadow-lg text-center">

        <h1 className="text-2xl font-semibold mb-4 text-white">
          📩 Check your email
        </h1>

        <p className="text-gray-300">
          We’ve sent you a verification link to activate your account.
        </p>

        <p className="text-gray-500 mt-4 text-sm">
          The link expires in 1 hour.
        </p>

        {/* ACTIONS */}
        <div className="mt-6 flex flex-col gap-3">

          <a
            href="/login"
            className="bg-white text-black py-2 rounded-md font-medium"
          >
            Go to login
          </a>

          {/* RESEND */}
          {email && (
            <form
              action="/api/auth/resend-verification"
              method="POST"
            >
              <input type="hidden" name="email" value={email} />

              <button
                type="submit"
                className="text-sm text-gray-400 hover:text-white"
              >
                Resend verification email
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}