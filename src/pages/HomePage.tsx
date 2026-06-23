import React from 'react';
import DefaultHero from '@/components/home/DefaultHero';
import HomeBlocks from '@/components/home/HomeBlocks';

const HomePage: React.FC = () => {
  return (
    <div className="bg-background">
      <DefaultHero />
      <HomeBlocks />
    </div>
  );
};

export default HomePage;
