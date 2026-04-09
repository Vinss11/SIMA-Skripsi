import React from "react";

const ActionCard = ({ icon, title, description, buttonText, buttonColor, onClick }) => {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700",
    yellow: "bg-yellow-500 hover:bg-yellow-600",
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex items-start space-x-3 mb-4">
        <div className="text-blue-600">{icon}</div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <button onClick={onClick} className={`w-full ${colors[buttonColor]} text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2`}>
        <span>{buttonText}</span>
        <span>→</span>
      </button>
    </div>
  );
};

export default ActionCard;
