import React from 'react';
import DefaultHero from '@/components/home/DefaultHero';
import HomeBlocks from '@/components/home/HomeBlocks';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import SaleProducts from '@/components/home/SaleProducts';
import BrandsShowcase from '@/components/home/BrandsShowcase';

const HomePage: React.FC = () => {
  return (
    <div className="bg-background">
      <DefaultHero />
      <FeaturedProducts />
      <SaleProducts />
      <BrandsShowcase />
      <HomeBlocks />
    </div>
  );
};

export default HomePage;
