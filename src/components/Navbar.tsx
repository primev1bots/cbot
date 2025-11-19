import React from "react";
import {
  Home as HomeIcon,
  BanknoteArrowUp,
  Users,
  Coins,
  UserRound,
} from "lucide-react";

type Tab = "home" | "tasks" | "friends" | "bonus" | "profile" | "spin";

interface NavbarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const getTabClass = (tabName: Tab) =>
    [
      "text-center w-1/5 m-1 p-2 rounded-2xl transition-all duration-300",
      currentTab === tabName
        ? "bg-white shadow-sm text-blue-600 border border-blue-200"
        : "bg-transparent text-gray-700 hover:text-blue-500 border border-transparent",
    ].join(" ");

  const getIconClass = (tabName: Tab) => 
    currentTab === tabName ? "text-blue-600" : "text-gray-700";

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-white/70 backdrop-blur-xl flex justify-around items-center z-50 rounded-3xl text-xs shadow-xl border border-gray-300">
      <button 
        onClick={() => onTabChange("home")} 
        className={getTabClass("home")}
      >
        <HomeIcon className={`w-8 h-8 mx-auto ${getIconClass("home")}`} />
        <p className="mt-1 font-medium">Home</p>
      </button>

      <button 
        onClick={() => onTabChange("tasks")} 
        className={getTabClass("tasks")}
      >
        <BanknoteArrowUp className={`w-8 h-8 mx-auto ${getIconClass("tasks")}`} />
        <p className="mt-1 font-medium">Tasks</p>
      </button>

      <button 
        onClick={() => onTabChange("friends")} 
        className={getTabClass("friends")}
      >
        <Users className={`w-8 h-8 mx-auto ${getIconClass("friends")}`} />
        <p className="mt-1 font-medium">Friends</p>
      </button>

      <button 
        onClick={() => onTabChange("bonus")} 
        className={getTabClass("bonus")}
      >
        <Coins className={`w-8 h-8 mx-auto ${getIconClass("bonus")}`} />
        <p className="mt-1 font-medium">Bonus</p>
      </button>

      <button 
        onClick={() => onTabChange("profile")} 
        className={getTabClass("profile")}
      >
        <UserRound className={`w-8 h-8 mx-auto ${getIconClass("profile")}`} />
        <p className="mt-1 font-medium">Profile</p>
      </button>
    </div>
  );
};

export default Navbar;