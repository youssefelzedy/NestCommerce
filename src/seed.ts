import { DataSource } from 'typeorm';
import { Category } from './categories/entities/category.entity';
import { Product } from './products/entities/product.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'nestdb',
  entities: [Category, Product],
  synchronize: true,
  dropSchema: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  const categoryRepo = AppDataSource.getRepository(Category);
  const productRepo = AppDataSource.getRepository(Product);

  // --- Dummy categories with real products ---
  const categoryData = [
    {
      name: 'Electronics',
      description: 'Electronic gadgets and devices',
      products: [
        {
          name: 'iPhone 14 Pro',
          price: 1200,
          imageUrl: 'https://via.placeholder.com/150?text=iPhone+14+Pro',
        },
        {
          name: 'Samsung Galaxy S23',
          price: 1100,
          imageUrl: 'https://via.placeholder.com/150?text=Galaxy+S23',
        },
        {
          name: 'Sony WH-1000XM5',
          price: 400,
          imageUrl: 'https://via.placeholder.com/150?text=Sony+Headphones',
        },
        {
          name: 'MacBook Air M2',
          price: 1400,
          imageUrl: 'https://via.placeholder.com/150?text=MacBook+Air',
        },
        {
          name: 'iPad Pro 12.9',
          price: 1300,
          imageUrl: 'https://via.placeholder.com/150?text=iPad+Pro',
        },
        {
          name: 'Apple Watch Series 8',
          price: 500,
          imageUrl: 'https://via.placeholder.com/150?text=Apple+Watch',
        },
        {
          name: 'GoPro Hero 11',
          price: 600,
          imageUrl: 'https://via.placeholder.com/150?text=GoPro+11',
        },
        {
          name: 'Dell XPS 13',
          price: 1250,
          imageUrl: 'https://via.placeholder.com/150?text=Dell+XPS+13',
        },
        {
          name: 'Kindle Paperwhite',
          price: 150,
          imageUrl: 'https://via.placeholder.com/150?text=Kindle',
        },
        {
          name: 'Nintendo Switch OLED',
          price: 350,
          imageUrl: 'https://via.placeholder.com/150?text=Switch+OLED',
        },
      ],
    },
    {
      name: 'Fashion',
      description: 'Clothing and accessories',
      products: [
        {
          name: 'Nike Air Force 1',
          price: 100,
          imageUrl: 'https://via.placeholder.com/150?text=Nike+AF1',
        },
        {
          name: 'Adidas Ultraboost',
          price: 180,
          imageUrl: 'https://via.placeholder.com/150?text=Ultraboost',
        },
        {
          name: 'Levi’s 501 Jeans',
          price: 90,
          imageUrl: 'https://via.placeholder.com/150?text=Levis+501',
        },
        {
          name: 'Gucci Belt',
          price: 400,
          imageUrl: 'https://via.placeholder.com/150?text=Gucci+Belt',
        },
        {
          name: 'North Face Jacket',
          price: 250,
          imageUrl: 'https://via.placeholder.com/150?text=North+Face',
        },
        {
          name: 'Puma Hoodie',
          price: 70,
          imageUrl: 'https://via.placeholder.com/150?text=Puma+Hoodie',
        },
        {
          name: 'Converse Chuck Taylor',
          price: 65,
          imageUrl: 'https://via.placeholder.com/150?text=Converse',
        },
        {
          name: 'Ray-Ban Wayfarer',
          price: 120,
          imageUrl: 'https://via.placeholder.com/150?text=Rayban',
        },
        {
          name: 'Zara T-Shirt',
          price: 25,
          imageUrl: 'https://via.placeholder.com/150?text=Zara+Tshirt',
        },
        {
          name: 'Louis Vuitton Bag',
          price: 2000,
          imageUrl: 'https://via.placeholder.com/150?text=LV+Bag',
        },
      ],
    },
    {
      name: 'Books',
      description: 'Popular books and novels',
      products: [
        {
          name: 'Atomic Habits',
          price: 20,
          imageUrl: 'https://via.placeholder.com/150?text=Atomic+Habits',
        },
        {
          name: 'The Lean Startup',
          price: 22,
          imageUrl: 'https://via.placeholder.com/150?text=Lean+Startup',
        },
        {
          name: '1984 by George Orwell',
          price: 15,
          imageUrl: 'https://via.placeholder.com/150?text=1984',
        },
        {
          name: 'To Kill a Mockingbird',
          price: 18,
          imageUrl: 'https://via.placeholder.com/150?text=Mockingbird',
        },
        {
          name: 'Sapiens',
          price: 25,
          imageUrl: 'https://via.placeholder.com/150?text=Sapiens',
        },
        {
          name: 'Clean Code',
          price: 35,
          imageUrl: 'https://via.placeholder.com/150?text=Clean+Code',
        },
        {
          name: 'The Pragmatic Programmer',
          price: 40,
          imageUrl: 'https://via.placeholder.com/150?text=Pragmatic',
        },
        {
          name: 'Deep Work',
          price: 30,
          imageUrl: 'https://via.placeholder.com/150?text=Deep+Work',
        },
        {
          name: 'Harry Potter',
          price: 20,
          imageUrl: 'https://via.placeholder.com/150?text=Harry+Potter',
        },
        {
          name: 'The Alchemist',
          price: 15,
          imageUrl: 'https://via.placeholder.com/150?text=Alchemist',
        },
      ],
    },
    // باقي الكاتيجوريز زي ما هي (Home, Sports ...)
  ];

  // Save categories and products
  for (const catData of categoryData) {
    const category = categoryRepo.create({
      name: catData.name,
      description: catData.description,
    });
    await categoryRepo.save(category);

    const products = catData.products.map((p) =>
      productRepo.create({
        ...p,
        description: `${p.name} - high quality product`,
        stock: Math.floor(Math.random() * 100) + 10,
        rating: +(Math.random() * 5).toFixed(1),
        soldCount: Math.floor(Math.random() * 500),
        discountPercentage: +(Math.random() * 50).toFixed(2),
        category: category,
      }),
    );

    await productRepo.save(products);
  }

  console.log('✅ Real product seeding completed (with rating, soldCount, discountPercentage)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error seeding data', err);
  process.exit(1);
});
