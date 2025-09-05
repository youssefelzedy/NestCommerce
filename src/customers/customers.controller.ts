import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    customerId: number;
  };
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Request() req: RequestWithUser, @Param('id') id: number) {
    // req.user contains the decoded JWT payload which includes customerId
    const customer = await this.customersService.findCustomerById(id, req.user.customerId);
    return customer;
  }
}
