import React from "react";
import DosenWorkspacePage from "./DosenWorkspacePage";

function DosenDashboardPage(props) {
  return <DosenWorkspacePage {...props} isSekretaris={Boolean(props.isSekretaris)} />;
}

export default DosenDashboardPage;
