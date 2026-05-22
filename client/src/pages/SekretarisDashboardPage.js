import React from "react";
import DosenWorkspacePage from "./DosenWorkspacePage";

function SekretarisDashboardPage(props) {
  return <DosenWorkspacePage {...props} isSekretaris={true} />;
}

export default SekretarisDashboardPage;
