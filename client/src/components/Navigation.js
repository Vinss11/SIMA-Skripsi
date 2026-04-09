import React from "react";
import { Home, Users, Activity, MessageSquare, FileText } from "lucide-react";

const Navigation = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "pengajuan", label: "Pengajuan", icon: FileText },
    { id: "status", label: "Status", icon: Activity },
    { id: "bimbingan", label: "Bimbingan", icon: MessageSquare },
    { id: "dokumen", label: "Dokumen", icon: FileText },
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-6">
        <div className="flex space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${activeTab === item.id ? "border-blue-600 text-blue-600 bg-blue-50" : "border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50"}`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
