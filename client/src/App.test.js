import { render, screen } from "@testing-library/react";
import App from "./App";

test("menampilkan judul login", () => {
  render(<App />);
  const headingElement = screen.getByText(/simp uii/i);
  expect(headingElement).toBeInTheDocument();
});
