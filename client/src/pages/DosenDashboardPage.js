import React from "react";
import DosenWorkspacePage from "./DosenWorkspacePage";

function DosenDashboardPage(props) {
  return <DosenWorkspacePage {...props} isSekretaris={false} />;
}

export default DosenDashboardPage;
