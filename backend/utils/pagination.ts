
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const getPagination = ({
  page,
  limit,
}: PaginationParams) => {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
};

export const getPaginationMeta = ({
  page,
  limit,
  total,
}: PaginationParams & { total: number }): PaginationMeta => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};
