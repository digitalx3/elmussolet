import React from 'react';
import HeroCarousel from '@/components/home/HeroCarousel';
import HomeBlocks from '@/components/home/HomeBlocks';

const HomePage: React.FC = () => {
  return (
    <div className="bg-background">
      <HeroCarousel />
      <HomeBlocks />
    </div>
  );
};

export default HomePage;
