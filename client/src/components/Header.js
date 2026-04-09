import React from "react";
import { User } from "lucide-react";

const Header = ({ userName, userNim }) => {
  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-400 text-blue-900 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl">S</div>
            <div>
              <h1 className="text-xl font-bold">SIMPS UII</h1>
              <p className="text-sm text-blue-100">Sistem Informasi Manajemen Pengujian Skripsi</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5" />
            <div className="text-right">
              <p className="font-semibold">{userName}</p>
              <p className="text-xs text-blue-100">{userNim}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
