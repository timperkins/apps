import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { AccountMenu, InstallButton, TodayDate } from "./MastheadClient";

export function Masthead() {
  return (
    <header>
      <div className="utility">
        <InstallButton />
        <AccountMenu />
      </div>
      <div className="masthead">
        <Link href="/" className="name">
          {APP_NAME}
        </Link>
        <div className="date">
          <TodayDate />
        </div>
      </div>
    </header>
  );
}
