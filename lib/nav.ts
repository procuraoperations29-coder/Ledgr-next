import {
  LayoutDashboard,
  ArrowLeftRight,
  ReceiptText,
  Users,
  Truck,
  Landmark,
  Package,
  BarChart3,
  BookOpen,
  CreditCard,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  ready: boolean; // false = shown but disabled (later phase)
}

/** Desktop sidebar (§35). Items marked ready:false are placeholders for now. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight, ready: true },
  { label: 'Chart of Accounts', href: '/accounts', icon: BookOpen, ready: true },
  { label: 'Reports', href: '/reports', icon: BarChart3, ready: true },
  { label: 'Sales & Invoices', href: '/sales', icon: ReceiptText, ready: true },
  { label: 'Expenses', href: '/expenses', icon: ReceiptText, ready: true },
  { label: 'Customers', href: '/customers', icon: Users, ready: true },
  { label: 'Suppliers', href: '/suppliers', icon: Truck, ready: true },
  { label: 'Bank & Cash', href: '/bank', icon: Landmark, ready: true },
  { label: 'Inventory', href: '/inventory', icon: Package, ready: true },
  { label: 'Billing & Plan', href: '/billing', icon: CreditCard, ready: true },
  { label: 'Support', href: '/support', icon: LifeBuoy, ready: true },
  { label: 'Settings', href: '/settings', icon: Settings, ready: true },
];
