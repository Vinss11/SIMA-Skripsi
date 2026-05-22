import React from "react";

function StandardTabs({ items, activeKey, onChange, backButton = null, className = "" }) {
  return (
    <div className={`w-full border-b border-[#e6ecf8] ${className}`}>
      <div className="flex flex-wrap items-end gap-5">
        {backButton ? (
          <button
            type="button"
            onClick={backButton.onClick}
            disabled={backButton.disabled}
            title={backButton.title}
            className={`inline-flex items-center justify-center rounded-md pb-3 pt-2 transition ${
              backButton.disabled
                ? "cursor-not-allowed text-[#a6b3d3]"
                : "text-[#63739b] hover:text-[#2d467f]"
            }`}
          >
            {backButton.icon ? <backButton.icon className="h-4 w-4" /> : null}
          </button>
        ) : null}

        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeKey;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              disabled={item.disabled}
              className={`group relative inline-flex items-center gap-2 pb-3 pt-2 text-base font-semibold transition ${
                item.disabled
                  ? "cursor-not-allowed text-[#a6b3d3]"
                  : isActive
                    ? "text-[#1f2d53]"
                    : "text-[#677592] hover:text-[#304b84]"
              }`}
            >
              {Icon ? <Icon className="h-5 w-5" /> : null}
              <span>{item.label}</span>
              {isActive ? <span className="absolute -bottom-px left-0 right-0 h-[3px] rounded-full bg-[#2f63e3]" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StandardTabs;
