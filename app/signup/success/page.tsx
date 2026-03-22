// =====================================================
// SIGNUP SUCCESS PAGE (PRO UX)
// =====================================================

export default function SignupSuccessPage() {
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

      

        </div>

        <form
  action="/api/auth/resend-verification"
  method="POST"
  className="mt-2"
>
  <input type="hidden" name="email" value="" />

  <button
    type="submit"
    className="text-sm text-gray-400 hover:text-white"
  >
    Resend verification email
  </button>
</form>

      </div>
    </div>
  );
}