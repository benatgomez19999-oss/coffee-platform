// =====================================================
// VERIFY PAGE (SERVER — PRO UX)
// =====================================================

export const dynamic = "force-dynamic";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {

  const status = searchParams.status;

  // =====================================================
  // RENDER CONTENT
  // =====================================================

  function renderContent() {
    switch (status) {
      case "success":
        return (
          <>
            <h1 className="text-2xl font-semibold mb-4 text-white">
              ✅ Account verified
            </h1>
            <p className="text-gray-300">
              Your account has been successfully activated.
            </p>

            {/* AUTO REDIRECT */}
            <meta httpEquiv="refresh" content="2; url=/onboarding/role" />
          </>
        );

      case "expired":
        return (
          <>
            <h1 className="text-2xl font-semibold mb-4 text-white">
              ⏰ Link expired
            </h1>
            <p className="text-gray-300">
              This verification link has expired.
            </p>
          </>
        );

      case "invalid":
        return (
          <>
            <h1 className="text-2xl font-semibold mb-4 text-white">
              ❌ Invalid link
            </h1>
            <p className="text-gray-300">
              This verification link is not valid.
            </p>
          </>
        );

      default:
        return (
          <>
            <h1 className="text-2xl font-semibold mb-4 text-white">
              ⚠️ Something went wrong
            </h1>
            <p className="text-gray-300">
              Please try again or request a new link.
            </p>
          </>
        );
    }
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="max-w-md w-full bg-neutral-900 p-8 rounded-xl shadow-lg text-center">
        {renderContent()}
      </div>
    </div>
  );
}