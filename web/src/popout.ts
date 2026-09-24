import "./style.css";
import { createBridge } from "./core/createBridge";
import { WidgetKind } from "./core/types";
import { PopoutApp } from "./ui/popoutApp";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app root element");

const params = new URLSearchParams(window.location.search);
const requested = params.get("widget");
const kind = (requested === "clock" || requested === "combined" ? requested : "timer") as WidgetKind;

new PopoutApp(root, createBridge(), kind);
