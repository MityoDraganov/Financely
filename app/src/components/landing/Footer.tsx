import * as React from "react";

export function Footer(): React.ReactElement {
  return (
    <footer className="bg-[#0f172a] py-16 text-gray-300">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-4">
        <div>
          <h4 className="mb-4 text-lg font-bold text-white">Financely</h4>
          <p className="text-sm leading-relaxed text-gray-400">Smart invoicing & contract automation for modern businesses.</p>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white">Product</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#features" className="text-gray-300 hover:text-white">Features</a></li>
            <li><a href="#pricing" className="text-gray-300 hover:text-white">Pricing</a></li>
          </ul>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white">Company</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="text-gray-300 hover:text-white">About</a></li>
            <li><a href="#" className="text-gray-300 hover:text-white">Careers</a></li>
          </ul>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white">Legal</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="text-gray-300 hover:text-white">Privacy</a></li>
            <li><a href="#" className="text-gray-300 hover:text-white">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 text-center text-sm text-gray-500">© {new Date().getFullYear()} Financely. All rights reserved.</div>
    </footer>
  );
}


