// =====================================================
// VERIFY PAGE (SERVER SAFE — NO BUILD ERROR)
// =====================================================

export const dynamic = "force-dynamic";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  if (!token) {
    return <p>Invalid verification link</p>;
  }

  // =====================================================
  // REDIRECT SERVER SIDE
  // =====================================================

  return (
    <meta
      httpEquiv="refresh"
      content={`0; url=/api/auth/verify?token=${token}`}
    />
  );
}