export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* Page title skeleton */}
      <div className="h-7 w-48 bg-gray-200 rounded-xl mb-2" />
      <div className="h-4 w-32 bg-gray-100 rounded-lg mb-8" />

      {/* Stats grid skeleton (dashboard-style) */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl p-5 h-24" />
        ))}
      </div>

      {/* Card rows skeleton */}
      <div className="flex flex-col gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
            <div className="flex justify-between">
              <div className="h-5 w-40 bg-gray-100 rounded-lg" />
              <div className="h-5 w-20 bg-gray-100 rounded-lg" />
            </div>
            <div className="h-4 w-64 bg-gray-50 rounded-lg" />
            <div className="h-4 w-48 bg-gray-50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
