import React from 'react';
import DefaultHero from '@/components/home/DefaultHero';
import HomeBlocks from '@/components/home/HomeBlocks';
import FeaturedProducts from '@/components/home/FeaturedProducts';

const HomePage: React.FC = () => {
  return (
    <div className="bg-background">
      <DefaultHero />
      <FeaturedProducts />
      <HomeBlocks />
    </div>
  );
};

export default HomePage;
