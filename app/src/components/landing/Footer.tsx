import * as React from "react";

export function Footer(): React.ReactElement {
  return (
    <footer className="bg-[#0f172a] dark:bg-[#0a0a0a] py-16 text-gray-300 dark:text-gray-400 border-t border-gray-800 dark:border-gray-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-4">
        <div>
          <h4 className="mb-4 text-lg font-bold text-white dark:text-gray-100">Financely</h4>
          <p className="text-sm leading-relaxed text-gray-400 dark:text-gray-500">Smart invoicing & contract automation for modern businesses.</p>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white dark:text-gray-100">Product</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#features" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">Features</a></li>
            <li><a href="#pricing" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">Pricing</a></li>
          </ul>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white dark:text-gray-100">Company</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">About</a></li>
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">Careers</a></li>
          </ul>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white dark:text-gray-100">Legal</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">Privacy</a></li>
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-600">© {new Date().getFullYear()} Financely. All rights reserved.</div>
    </footer>
  );
}


