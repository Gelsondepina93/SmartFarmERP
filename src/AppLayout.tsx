import React from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { Outlet } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Close sidebar on small screens by default
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        isSidebarOpen ? "lg:pl-64" : "lg:pl-16"
      )}>
        <Topbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="p-4 md:p-8 pb-16 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </main>
        
        {/* Connection Status Banner */}
        {!navigator.onLine && (
          <div className={cn(
            "fixed bottom-0 right-0 transition-all duration-300 bg-dark-surface border-t border-dark-border text-white py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 z-50",
            isSidebarOpen ? "lg:left-64" : "lg:left-16",
            "left-0"
          )}>
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            Modo Offline: Os registros serão sincronizados quando a conexão for restaurada.
          </div>
        )}
      </div>
    </div>
  );
};

export default AppLayout;
