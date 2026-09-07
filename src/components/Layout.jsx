import TopBar from './TopBar'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#F5F7F8] print:bg-white">
      <div className="print:hidden">
        <TopBar />
      </div>
      <div className="flex">
        <div className="print:hidden">
          <Sidebar />
        </div>
        <main className="flex-1 p-4 md:p-8 min-w-0 print:p-0 print:w-full">{children}</main>
      </div>
    </div>
  )
}
