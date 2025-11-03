'use client';

import { useState } from 'react';
import {
  SERVICES,
  searchServices,
  getServicesByCategory,
  getPopularServices,
  type ServiceInfo,
} from '@/lib/services/service-detection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ServiceSelectorProps {
  onSelectService: (service: ServiceInfo) => void;
  autoDetectedService?: ServiceInfo | null;
}

/**
 * Service Selector Component
 *
 * Grid of services with search and filtering
 * Supports auto-detection from project context
 */
export function ServiceSelector({
  onSelectService,
  autoDetectedService,
}: ServiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    ServiceInfo['category'] | 'all'
  >('all');

  // Filter services based on search and category
  const filteredServices =
    searchQuery.trim() !== ''
      ? searchServices(searchQuery)
      : selectedCategory === 'all'
      ? SERVICES
      : getServicesByCategory(selectedCategory);

  const categories: Array<{ value: ServiceInfo['category'] | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'ai', label: 'AI' },
    { value: 'payments', label: 'Payments' },
    { value: 'email', label: 'Email' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'database', label: 'Database' },
    { value: 'auth', label: 'Auth' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-6">
      {/* Auto-detected service banner */}
      {autoDetectedService && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <svg
                  className="h-5 w-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm">
                  Detected: {autoDetectedService.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Based on your project name
                </p>
              </div>
            </div>
            <Button onClick={() => onSelectService(autoDetectedService)}>
              Use {autoDetectedService.name}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <Input
          placeholder="Search services (e.g., OpenAI, Stripe, AWS)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.value}
            variant={selectedCategory === category.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.value)}
          >
            {category.label}
          </Button>
        ))}
      </div>

      {/* Popular services (if no search/filter) */}
      {searchQuery === '' && selectedCategory === 'all' && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Popular Services</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {getPopularServices().map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => onSelectService(service)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All services grid */}
      <div>
        {searchQuery !== '' || selectedCategory !== 'all' ? (
          <h3 className="text-sm font-semibold mb-3">
            {searchQuery ? `Results for "${searchQuery}"` : 'Services'}
            <span className="text-muted-foreground font-normal ml-2">
              ({filteredServices.length})
            </span>
          </h3>
        ) : (
          <h3 className="text-sm font-semibold mb-3">All Services</h3>
        )}

        {filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block p-4 rounded-full bg-muted mb-4">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              No services found matching "{searchQuery}"
            </p>
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => onSelectService(service)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Other service option */}
      <div className="border-t pt-6">
        <button
          onClick={() => {
            // TODO: Open custom URL input dialog
            console.log('Custom service not yet implemented');
          }}
          className="w-full p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted group-hover:bg-primary/10 p-2 transition-colors">
              <svg
                className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                Other Service
              </p>
              <p className="text-xs text-muted-foreground">
                Enter a custom documentation URL
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

/**
 * Service Card Component
 */
function ServiceCard({
  service,
  onClick,
}: {
  service: ServiceInfo;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg border hover:border-primary hover:bg-accent transition-all text-left group"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
            {service.name}
          </h4>
          <Badge variant="secondary" className="mt-1 text-xs">
            {service.category}
          </Badge>
        </div>
        {/* Optional: Add service logos here */}
        {service.logoUrl && (
          <img
            src={service.logoUrl}
            alt={`${service.name} logo`}
            className="w-8 h-8 rounded"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {service.description}
      </p>
    </button>
  );
}
