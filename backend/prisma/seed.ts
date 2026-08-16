import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Super Admin ────────────────────────────────────────
  const existingAdmin = await prisma.superAdmin.findUnique({
    where: { email: 'admin@myerp.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123456', 12);

    await prisma.superAdmin.create({
      data: {
        name: 'Super Admin',
        email: 'admin@myerp.com',
        password: hashedPassword,
        isActive: true,
      },
    });

    console.log('✅ Super Admin created');
    console.log('   Email:    admin@myerp.com');
    console.log('   Password: Admin@123456');
  } else {
    console.log('⚠️  Super Admin already exists, skipping');
  }

  // ── Default Modules ────────────────────────────────────
  const modules = [
    { name: 'Dashboard',             key: 'dashboard',    icon: 'LayoutDashboard', sortOrder: 1  },
    { name: 'Users & Roles',         key: 'users',        icon: 'Users',           sortOrder: 2  },
    { name: 'Customers & Suppliers', key: 'contacts',     icon: 'BookUser',        sortOrder: 3  },
    { name: 'Products',              key: 'products',     icon: 'Package',         sortOrder: 4  },
    { name: 'Inventory',             key: 'inventory',    icon: 'Warehouse',       sortOrder: 5  },
    { name: 'Purchase',              key: 'purchase',     icon: 'ShoppingCart',    sortOrder: 6  },
    { name: 'Sales',                 key: 'sales',        icon: 'TrendingUp',      sortOrder: 7  },
    { name: 'Invoices',              key: 'invoices',     icon: 'FileText',        sortOrder: 8  },
    { name: 'Accounts & Finance',    key: 'finance',      icon: 'Landmark',        sortOrder: 9  },
    { name: 'Ledger',                key: 'ledger',       icon: 'BookOpen',        sortOrder: 10 },
    { name: 'Reports',               key: 'reports',      icon: 'BarChart2',       sortOrder: 11 },
    { name: 'HR',                    key: 'hr',           icon: 'UserCheck',       sortOrder: 12 },
    { name: 'Payroll',               key: 'payroll',      icon: 'Wallet',          sortOrder: 13 },
    { name: 'Manufacturing',         key: 'manufacturing',icon: 'Factory',         sortOrder: 14 },
    { name: 'Stock Adjustment',      key: 'stock_adjust', icon: 'RefreshCw',       sortOrder: 15 },
    { name: 'Settings',              key: 'settings',     icon: 'Settings',        sortOrder: 16 },
    { name: 'Backup',                key: 'backup',       icon: 'DatabaseBackup',  sortOrder: 17 },
  ];

  for (const module of modules) {
    await prisma.module.upsert({
      where: { key: module.key },
      update: {},
      create: {
        name: module.name,
        key: module.key,
        icon: module.icon,
        sortOrder: module.sortOrder,
        isActive: true,
      },
    });
  }

  console.log('✅ All 17 modules seeded');
  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });