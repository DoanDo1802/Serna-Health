import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4 bg-canvas text-content-primary">
      <h2 className="text-4xl font-bold text-content-primary mb-4">404 - Trang Không Tồn Tại</h2>
      <p className="text-content-secondary mb-8 max-w-md">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary-hover shadow-card transition-all"
      >
        Trở Về Trang Chủ
      </Link>
    </div>
  );
}
