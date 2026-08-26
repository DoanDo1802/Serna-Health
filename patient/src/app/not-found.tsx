import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <h2 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h2>
      <p className="text-gray-600 mb-8 max-w-md">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-[#111] text-white rounded-full font-medium hover:bg-black transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
