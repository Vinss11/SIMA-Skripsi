import React from "react";

function MenuSectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <section className="rounded-xl bg-gradient-to-r from-[#2f63e3] to-[#3f6de2] px-4 py-4 text-white shadow-[0_14px_28px_-20px_rgba(39,77,173,0.85)] md:px-5">
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/10">
            <Icon className="h-5 w-5 text-white" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black leading-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-[#dce6ff]">{subtitle}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default MenuSectionHeader;
