import React from "react";

const InfoCard = ({ icon, title, subtitle, badge, badgeColor }) => {
  const bgColors = {
    yellow: "bg-yellow-50 border-yellow-200",
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
    green: "bg-green-50 border-green-200",
  };

  const badgeColors = {
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    green: "bg-green-100 text-green-800",
  };

  return (
    <div className={`${bgColors[badgeColor]} border rounded-lg p-6 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-gray-500 text-sm">{icon}</span>
        {badge && <span className={`${badgeColors[badgeColor]} px-3 py-1 rounded-full text-xs font-semibold`}>{badge}</span>}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </div>
  );
};

export default InfoCard;
