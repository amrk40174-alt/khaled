import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, FileText, CreditCard, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "الرئيسية", path: "/" },
    { icon: Users, label: "التجار", path: "/merchants" },
    { icon: FileText, label: "الفواتير", path: "/invoices" },
    { icon: CreditCard, label: "إدارة الدفع الجزئي", path: "/statistics" },
  ];

  const NavContent = () => (
    <div className="flex flex-col space-y-2 p-4">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex items-center space-x-3 space-x-reverse p-3 rounded-lg transition-colors ${
            location.pathname === item.path
              ? "bg-primary text-primary-foreground shadow-md"
              : "hover:bg-accent text-foreground"
          }`}
        >
          <item.icon className="h-5 w-5" />
          <span className="font-medium">{item.label}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">إدارة التجار</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="mt-6">
                <NavContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:flex fixed top-0 right-0 bottom-0 w-64 bg-card border-l shadow-lg">
        <div className="flex flex-col w-full">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-primary">إدارة التجار</h1>
            <p className="text-sm text-muted-foreground mt-1">نظام إدارة شامل</p>
          </div>
          <nav className="flex-1 overflow-y-auto">
            <NavContent />
          </nav>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t lg:hidden shadow-lg">
        <div className="flex items-center justify-around p-3">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 p-2 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
                location.pathname === item.path
                  ? "text-primary bg-primary/10 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className={`transition-all duration-200 ${
                location.pathname === item.path ? "h-6 w-6" : "h-5 w-5"
              }`} />
              <span className={`text-xs font-medium truncate transition-all duration-200 ${
                location.pathname === item.path ? "font-semibold" : ""
              }`}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navigation;